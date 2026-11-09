// Koji načini prijave su uključeni (ovisi o postavljenim varijablama). Email kod je uvijek uključen.
import { json } from '../../_lib/util.js';
import { enabledProviders } from '../../_lib/oidc.js';
export const onRequestGet = ({ env }) => json({ ok: true, pruzaoci: enabledProviders(env) });
