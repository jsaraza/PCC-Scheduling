import {mkdirSync,copyFileSync,readdirSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";
const root=fileURLToPath(new URL("../",import.meta.url));
export function prepareOCR(){
 const out=path.join(root,"public/ocr");mkdirSync(out,{recursive:true});
 copyFileSync(path.join(root,"node_modules/tesseract.js/dist/worker.min.js"),path.join(out,"worker.min.js"));
 const core=path.join(root,"node_modules/tesseract.js-core");
 for(const name of readdirSync(core))if(/\.wasm(\.js)?$/.test(name))copyFileSync(path.join(core,name),path.join(out,name));
 copyFileSync(path.join(root,"node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz"),path.join(out,"eng.traineddata.gz"));
 copyFileSync(path.join(core,"LICENSE"),path.join(out,"LICENSE-core.txt"));
 copyFileSync(path.join(root,"node_modules/tesseract.js/LICENSE.md"),path.join(out,"LICENSE-tesseract.txt"));
}
