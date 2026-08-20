import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  /* Guarda del invariante de media: la URL de un asset no cambia NUNCA.
     Sin esto el invariante es solo convención — un commit futuro que vuelva a
     poner `uploader.rename` reintroduce en silencio la desincronización entera
     (la carpeta vive dentro del public_id, o sea dentro de la URL, o sea dentro
     de lo que `cms_data` tiene guardado). Falla el lint, que corre en el build. */
  {
    files: ["lib/**/*.ts", "app/**/*.ts", "components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='rename'][callee.object.property.name='uploader']",
          message:
            "uploader.rename() cambia el public_id y por lo tanto la URL de entrega, invalidando toda referencia guardada en cms_data. El estado del ciclo de vida va en TAGS: usá setAssetState() (lib/storage.ts).",
        },
        {
          // Forma de asignación: `options.overwrite = true` — la que usa storage.ts.
          selector: "AssignmentExpression[left.property.name='overwrite'][right.value=true]",
          message:
            "overwrite: true permite que una subida reemplace los bytes de un asset existente con el mismo public_id, sin ningún cambio en la DB que lo delate. Usá unique_filename: true.",
        },
        {
          // Forma literal: `{ overwrite: true }`.
          selector: "Property[key.name='overwrite'][value.value=true]",
          message:
            "overwrite: true permite que una subida reemplace los bytes de un asset existente con el mismo public_id, sin ningún cambio en la DB que lo delate. Usá unique_filename: true.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
