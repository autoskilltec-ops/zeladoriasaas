import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Aponta o Turbopack para a raiz correta do projeto.
  // Necessário porque existe um package-lock.json vazio na pasta pai (appzeladoria/).
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
