import fs from 'fs';

export const fileToBase64 = (filePath: string) => fs.readFileSync(filePath, 'base64');
