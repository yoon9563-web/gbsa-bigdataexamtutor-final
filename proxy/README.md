# 선택: API 키를 숨기는 프록시

기본 사이트는 사용자가 **자기 Anthropic API 키**를 설정에 입력해 브라우저에서 바로 Claude를 호출합니다.
운영자의 키로 여러 사람에게 서비스하려면 이 폴더의 Cloudflare Worker를 배포하고, 사이트 설정의 **프록시 주소**에 Worker 주소를 넣으세요.

1. Cloudflare 대시보드 → Workers & Pages → Create → Worker를 만들고 `cloudflare-worker.js` 내용을 붙여 넣습니다.
2. Settings → Variables에서 `ANTHROPIC_API_KEY`(Secret), `ALLOWED_ORIGINS`(예: `https://<github-id>.github.io`)를 넣습니다. 지인에게만 공유하려면 `ACCESS_CODE`도 정하세요.
3. 모든 사용자의 기본값으로 쓰려면 `web/js/config.js`의 `apiBaseURL`에 Worker 주소(예: `https://bigdata-tutor.<계정>.workers.dev`)를 넣고 커밋합니다.

주의
- 프록시를 공개하면 누구나 당신의 키로 호출할 수 있습니다. `ALLOWED_ORIGINS`, `ACCESS_CODE`, Cloudflare Rate Limiting으로 반드시 제한하세요. 출처(Origin) 검사는 브라우저 밖에서 위조될 수 있습니다.
- Anthropic Console에서 이 키에 월 사용 한도를 걸어 두세요.
- `ACCESS_CODE`를 정했다면 사용자는 사이트 설정의 **접속 코드**에 그 값을 넣어야 합니다.
