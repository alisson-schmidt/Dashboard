import { setGlobalDispatcher, ProxyAgent } from "undici";
import { logger } from "./logger.js";

export function configureNetworkProxy() {
  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.https_proxy ||
    process.env.http_proxy;

  if (proxyUrl && proxyUrl.trim()) {
    try {
      const cleanProxy = proxyUrl.trim();
      const dispatcher = new ProxyAgent(cleanProxy);
      setGlobalDispatcher(dispatcher);
      logger.info(`[Rede Privada / Proxy] Agente global de proxy configurado com sucesso para saída de rede: ${cleanProxy}`);
    } catch (err: any) {
      logger.warn(`[Rede Privada / Proxy] Não foi possível ativar ProxyAgent: ${err?.message || err}`);
    }
  }
}
