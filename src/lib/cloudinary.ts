import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };

/**
 * Sube una imagen a Cloudinary
 * @param file - base64 de la imagen (data URL)
 * @param folder - Carpeta en Cloudinary
 * @returns URL de la imagen subida
 */
export async function uploadImage(
  file: string,
  folder: string = 'entities'
): Promise<string> {
  const result = await cloudinary.uploader.upload(file, {
    folder: `billedy/${folder}`,
    transformation: [
      { width: 128, height: 128, crop: 'fill' },
      { quality: 'auto' },
      { fetch_format: 'auto' },
    ],
  });

  return result.secure_url;
}

/**
 * Elimina una imagen de Cloudinary
 * @param url - URL de la imagen a eliminar
 */
export async function deleteImage(url: string): Promise<void> {
  // Extraer el public_id de la URL
  const matches = url.match(/billedy\/[\w/-]+/);
  if (matches) {
    const publicId = matches[0].replace(/\.[^/.]+$/, ''); // Remove extension
    await cloudinary.uploader.destroy(publicId);
  }
}
