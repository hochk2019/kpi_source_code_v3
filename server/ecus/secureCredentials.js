import os from "node:os";

import { existsSync, readFileSync } from "node:fs";

import { fileURLToPath } from "node:url";

import { execFileSync } from "node:child_process";



const DEFAULT_SECURE_FILE = process.env.ECUS_SQL_SECURE_FILE || "";

const DEFAULT_PWSH_PATH = process.env.PWSH_PATH || "pwsh";



let cachedCredentials = null;

let hasLoadedCredentials = false;



function trimValue(value) {

  return typeof value === "string" ? value.trim() : "";

}



function readEnvCredentials() {

  return {

    server: trimValue(process.env.ECUS_SQL_SERVER || ""),

    database: trimValue(process.env.ECUS_SQL_DATABASE || ""),

    user: trimValue(process.env.ECUS_SQL_USER || ""),

    password: process.env.ECUS_SQL_PASSWORD || "",

  };

}



function resolveSecureFilePath(customPath = DEFAULT_SECURE_FILE) {

  const target = trimValue(customPath || "");

  if (target) {

    return target;

  }

  try {

    const fallbackUrl = new URL("../../config/ecus.credentials.enc", import.meta.url);

    return fileURLToPath(fallbackUrl);

  } catch {

    return "";

  }

}



function loadFromSecureFile(options = {}) {

  const secureFilePath = resolveSecureFilePath(options.secureFile);

  if (!secureFilePath || !existsSync(secureFilePath)) {

    return null;

  }



  if (os.platform() !== "win32") {

    console.warn(

      "ECUS_SQL_SECURE_FILE chỉ có thể giải mã trên Windows. Vui lòng chạy trên môi trường Windows 11 Pro.",

    );

    return null;

  }



  const pwshPath = trimValue(options.pwshPath || DEFAULT_PWSH_PATH);

  const scriptUrl = new URL("../../scripts/read-ecus-credentials.ps1", import.meta.url);

  const scriptPath = fileURLToPath(scriptUrl);



  try {

    const stdout = execFileSync(

      pwshPath || "pwsh",

      ["-NoProfile", "-NonInteractive", "-File", scriptPath, "-Path", secureFilePath],

      {

        encoding: "utf8",

        windowsHide: true,

        maxBuffer: 1024 * 1024,

      },

    );

    const payload = stdout ? stdout.trim() : "";

    if (!payload) {

      return null;

    }

    const parsed = JSON.parse(payload);

    return {

      server: trimValue(parsed.server),

      database: trimValue(parsed.database),

      user: trimValue(parsed.user),

      password: typeof parsed.password === "string" ? parsed.password : "",

    };

  } catch (error) {

    console.error("Không thể giải mã thông tin đăng nhập ECUS từ DPAPI.", error);

    return null;

  }

}



function mergeCredentials(primary, fallback) {

  return {

    server: primary.server || fallback.server || "",

    database: primary.database || fallback.database || "",

    user: primary.user || fallback.user || "",

    password: primary.password || fallback.password || "",

  };

}



function loadCredentials(options = {}) {

  const envCredentials = readEnvCredentials();

  if (

    envCredentials.server &&

    envCredentials.database &&

    envCredentials.user &&

    envCredentials.password

  ) {

    return envCredentials;

  }



  const secureCredentials = loadFromSecureFile(options);

  if (secureCredentials) {

    return mergeCredentials(secureCredentials, envCredentials);

  }



  return envCredentials;

}



export function getSecureSqlCredentials(options = {}) {

  if (!hasLoadedCredentials || options.forceReload) {

    cachedCredentials = loadCredentials(options);

    hasLoadedCredentials = true;

  }

  if (!cachedCredentials || typeof cachedCredentials !== "object") {

    cachedCredentials = {

      server: "",

      database: "",

      user: "",

      password: "",

    };

  }

  return { ...cachedCredentials };

}



export function resetSecureSqlCredentialCache() {

  cachedCredentials = null;

  hasLoadedCredentials = false;

}



export function readSecureFileRaw(secureFilePath) {

  const filePath = resolveSecureFilePath(secureFilePath);

  if (!filePath || !existsSync(filePath)) {

    return "";

  }

  return readFileSync(filePath, "utf8");

}

