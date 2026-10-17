import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };

/**
 * Solo data URLs de imagen en base64. Cloudinary también acepta URLs remotas
 * (http, ftp, s3…) y las descargaría desde su servidor: no se permiten.
 */
const IMAGE_DATA_URL = /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[A-Za-z0-9+/]+=*$/;

export function isImageDataUrl(file: string): boolean {
  return IMAGE_DATA_URL.test(file);
}

/**
 * Sube una imagen a Cloudinary
 * @param file - base64 de la imagen (data URL de imagen; cualquier otra cosa se rechaza)
 * @param folder - Carpeta en Cloudinary
 * @returns URL de la imagen subida
 */
export async function uploadImage(
  file: string,
  folder: string = 'entities'
): Promise<string> {
  if (!isImageDataUrl(file)) {
    throw new Error('Formato de imagen no válido');
  }

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
