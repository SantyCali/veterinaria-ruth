import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Celular: guarda el JSON en un archivo temporal y abre "Compartir" (Drive, mail, WhatsApp...). */
export async function saveBackupFile(fileName: string, json: string) {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(json);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Este dispositivo no permite compartir archivos.');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Guardar copia de seguridad' });
}
