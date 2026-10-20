import os from "node:os";
import path from "node:path";
export const dataDirectory=process.env.PCC_DATA_DIR||path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),".local","share"),"PCC Scheduling");
