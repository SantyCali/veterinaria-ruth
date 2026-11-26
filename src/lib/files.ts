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

/**
 * Abre el selector de archivos, sube el archivo al bucket privado y
 * lo registra en la tabla pet_files. Devuelve un mensaje de error o null.
 */
export async function pickAndUploadPetFile(opts: {
  petId: string;
  consultationId?: string | null;
  category: FileCategory;
  description?: string;
}): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ALLOWED, copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];

  const body = await fetch(asset.uri).then((r) => r.arrayBuffer());
  const safeName = asset.name.replace(/[^\w.\-]+/g, '_');
  const path = `${opts.petId}/${Date.now()}-${safeName}`;

  const upload = await supabase.storage.from(PET_FILES_BUCKET).upload(path, body, {
    contentType: asset.mimeType ?? 'application/octet-stream',
    upsert: false,
  });
  if (upload.error) return upload.error.message;

  const { error } = await supabase.from('pet_files').insert({
    pet_id: opts.petId,
    consultation_id: opts.consultationId ?? null,
    category: opts.category,
    storage_path: path,
    file_name: asset.name,
    mime_type: asset.mimeType ?? null,
    size_bytes: asset.size ?? null,
    description: opts.description?.trim() || null,
  });
  return error?.message ?? null;
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
