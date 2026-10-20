import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
 root:"local",publicDir:"../public",plugins:[
  {name:"offline-fonts",enforce:"pre",transform(code,id){if(id.endsWith("globals.css"))return code.replace(/@import url\('https:\/\/fonts\.googleapis\.com[^\n]+/g,"");}},
  react()
 ],
 build:{outDir:"../dist-local",emptyOutDir:true,target:"es2022"},
});
