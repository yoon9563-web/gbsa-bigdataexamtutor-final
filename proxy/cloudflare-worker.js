// 선택 사항: API 키를 숨기는 Cloudflare Worker 프록시.
// 사이트 사용자는 키 없이 설정의 "프록시 주소"만 넣으면 됩니다. 비용은 이 Worker의 키 소유자가 냅니다.
//
// 환경 변수 (Cloudflare 대시보드 > Worker > Settings > Variables):
//   ANTHROPIC_API_KEY  (Secret)  Anthropic API 키
//   ALLOWED_ORIGINS              쉼표로 구분한 허용 출처. 예: https://<github-id>.github.io
//   ACCESS_CODE        (선택)    값을 정하면 요청에 x-access-code 헤더가 같아야 통과합니다.
//
// 이 Worker는 POST /v1/messages 만 전달합니다. 공개 배포 시에는 Cloudflare의 Rate Limiting 규칙도 함께 거세요.

const UPSTREAM = 'https://api.anthropic.com';
const PASS_HEADERS = ['content-type', 'anthropic-version', 'anthropic-beta', 'accept'];

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!allowed.includes(origin)) return new Response('origin not allowed', { status: 403 });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });

    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/v1/messages') {
      return new Response('not found', { status: 404, headers: cors(origin) });
    }
    if (env.ACCESS_CODE && request.headers.get('x-access-code') !== env.ACCESS_CODE) {
      return new Response('access code required', { status: 401, headers: cors(origin) });
    }

    const headers = new Headers();
    for (const h of PASS_HEADERS) {
      const v = request.headers.get(h);
      if (v) headers.set(h, v);
    }
    headers.set('x-api-key', env.ANTHROPIC_API_KEY);

    const upstream = await fetch(`${UPSTREAM}/v1/messages${url.search}`, {
      method: 'POST',
      headers,
      body: request.body,
    });
    const out = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(cors(origin))) out.set(k, v);
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};
