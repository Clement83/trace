/**
 * Minimal global type augmentations for the guiv2 server.
 *
 * This file provides:
 *  - lightweight ambient declarations for `multer` and `fast-xml-parser`
 *    to avoid build errors when full @types packages are not available.
 *  - augmentation of Express `Request` to expose `file` / `files` populated by multer.
 *
 * The declarations are intentionally minimal and conservative — they are meant
 * to avoid TypeScript compile errors in the dev environment and can be replaced
 * by proper `@types/*` packages later.
 */

/* Allow importing 'multer' without full types installed */
declare module "multer" {
  import { RequestHandler } from "express";

  type MulterOptions = any;

  function multer(options?: MulterOptions): {
    single(fieldname: string): RequestHandler;
    array(fieldname: string, maxCount?: number): RequestHandler;
    fields(fields: Array<{ name: string; maxCount?: number }>): RequestHandler;
    any(): RequestHandler;
    storage: any;
    diskStorage: (opts: any) => any;
  };

  namespace multer {
    interface File {
      /** Field name specified in the form */
      fieldname: string;
      /** Name of the file on the user's computer */
      originalname: string;
      /** Encoding type of the file */
      encoding: string;
      /** Mime type of the file */
      mimetype: string;
      /** Size in bytes */
      size: number;
      /** Optional - destination folder (when using diskStorage) */
      destination?: string;
      /** Optional - filename on disk (when using diskStorage) */
      filename?: string;
      /** Optional - full path on disk (when using diskStorage) */
      path?: string;
      /** Optional - Buffer of file (if available) */
      buffer?: Buffer;
    }
  }

  export = multer;
}

/* Allow importing 'fast-xml-parser' with a minimal parse signature */
declare module "fast-xml-parser" {
  export function parse<T = any>(xmlData: string, options?: any): T;
  export default {
    parse: parse,
  };
}

/* Augment Express Request to include multer populated fields */
declare namespace Express {
  // Minimal Multer-like file description used in Request.file / Request.files
  interface MulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    destination?: string;
    filename?: string;
    path?: string;
    buffer?: Buffer;
  }

  interface Request {
    /**
     * When using `upload.single('kml')` or similar, multer sets `req.file`.
     * We mark it optional since not all requests will have it.
     */
    file?: MulterFile;

    /**
     * When using `upload.array()` or `upload.fields()` multer sets `req.files`.
     * It can be an array or an object depending on the API used; accept both shapes.
     */
    files?: MulterFile[] | { [fieldname: string]: MulterFile[] } | undefined;
  }
}
