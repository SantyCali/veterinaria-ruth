import * as DocumentPicker from 'expo-document-picker';
import { Linking, Platform } from 'react-native';

import { PET_FILES_BUCKET, supabase } from './supabase';
import type { FileCategory } from './types';

const ALLOWED = [
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'image/*',
];

const safeFileName = (name: string) => name.replace(/[^\w.\-]+/g, '_');

/** Sube un archivo elegido al bucket privado. Devuelve la ruta o un error. */
async function uploadAsset(asset: DocumentPicker.DocumentPickerAsset, path: string) {
  const body = await fetch(asset.uri).then((r) => r.arrayBuffer());
  const upload = await supabase.storage.from(PET_FILES_BUCKET).upload(path, body, {
    contentType: asset.mimeType ?? 'application/octet-stream',
    upsert: false,
  });
  return upload.error?.message ?? null;
}

/**
 * Abre el selector de archivos, sube el archivo al bucket privado y
 * lo registra en la tabla pet_files.
 * Devuelve { error } si falló, { uploaded: nombre } si se subió, o {} si se canceló.
 */
export async function pickAndUploadPetFile(opts: {
  petId: string;
  consultationId?: string | null;
  category: FileCategory;
  description?: string;
  /** Fecha del estudio en formato de base (AAAA-MM-DD). */
  studyDate?: string | null;
}): Promise<{ error?: string; uploaded?: string }> {
  const result = await DocumentPicker.getDocumentAsync({ type: ALLOWED, copyToCacheDirectory: true });
  if (result.canceled) return {};
  const asset = result.assets[0];

  const path = `${opts.petId}/${Date.now()}-${safeFileName(asset.name)}`;
  const uploadError = await uploadAsset(asset, path);
  if (uploadError) return { error: uploadError };

  const { error } = await supabase.from('pet_files').insert({
    pet_id: opts.petId,
    consultation_id: opts.consultationId ?? null,
    category: opts.category,
    storage_path: path,
    file_name: asset.name,
    mime_type: asset.mimeType ?? null,
    size_bytes: asset.size ?? null,
    description: opts.description?.trim() || null,
    study_date: opts.studyDate ?? null,
  });
  return error ? { error: error.message } : { uploaded: asset.name };
}

/**
 * Elige una imagen y la pone como foto de perfil de la mascota.
 * La foto anterior no se borra (nada se borra físicamente): queda en el bucket.
 */
export async function pickAndUploadPetPhoto(petId: string): Promise<{ error?: string; path?: string }> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true });
  if (result.canceled) return {};
  const asset = result.assets[0];
  if (asset.size && asset.size > 10 * 1024 * 1024) return { error: 'La foto pesa más de 10 MB.' };

  const path = `${petId}/foto-perfil-${Date.now()}-${safeFileName(asset.name)}`;
  const uploadError = await uploadAsset(asset, path);
  if (uploadError) return { error: uploadError };

  const { error } = await supabase.from('pets').update({ photo_path: path }).eq('id', petId);
  return error ? { error: error.message } : { path };
}

/** Abre un archivo del bucket privado con un link temporal (5 minutos). */
export async function openPetFile(path: string) {
  const { data, error } = await supabase.storage.from(PET_FILES_BUCKET).createSignedUrl(path, 300);
  if (error || !data) return error?.message ?? 'No se pudo abrir el archivo';
  if (Platform.OS === 'web') window.open(data.signedUrl, '_blank');
  else await Linking.openURL(data.signedUrl);
  return null;
}

export function fmtSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
