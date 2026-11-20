// Public assets are relative to the deployed application, including on Pages.
export function assetUrl(path){
  return (import.meta.env?.BASE_URL??'/')+path.replace(/^\/+/, '');
}
