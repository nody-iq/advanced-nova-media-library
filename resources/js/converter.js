export default (base64, mime = "", fileName) => {
  const sliceSize = 1024;
  const base64Content = base64.split(",")[1];
  const byteChars = window.atob(base64Content);
  const byteArrays = [];

  for (let offset = 0; offset < byteChars.length; offset += sliceSize) {
    const slice = byteChars.slice(offset, offset + sliceSize);
    const byteNumbers = new Array(slice.length)
      .fill()
      .map((_, i) => slice.charCodeAt(i));
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  const file = new Blob(byteArrays, { type: mime });
  file.name = fileName;

  return file;
};
