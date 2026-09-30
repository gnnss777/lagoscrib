import { APP_PROFILES, resolveAppProfile } from "./constants";

export const PRIVACY_POLICY_VERSION = "1";

// Encarregado pelo tratamento (LGPD art. 41). O FALLBACK é por perfil: o mesmo
// app serve dois clientes isolados e o texto legal de um não pode citar a marca
// do outro. Em deploy, PRIVACY_CONTACT_EMAIL manda e vale para os dois.
export const PRIVACY_CONTACT_EMAIL =
  process.env.PRIVACY_CONTACT_EMAIL ??
  `privacidade@${APP_PROFILES[resolveAppProfile(process.env)].contactDomain}`;

export const POLICY_CONSENT_SCOPE = "politica";

export const ANONYMIZED_NAME = "Usuário removido";