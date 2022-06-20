export const humanFileSize = (bytes: number): `${number} ${'B' | 'KB' | 'MB' | 'GB' | 'TB'}` => {
    const index = Math.floor(Math.log(bytes) / Math.log(1024));

    return `${(Number((bytes / 1024 ** index).toFixed(2)))} ${(['B', 'KB', 'MB', 'GB', 'TB'] as const)[index]}`;
};
