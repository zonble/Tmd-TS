/// <reference types="vite/client" />

declare module "*.tmd?raw" {
  const content: string;
  export default content;
}
