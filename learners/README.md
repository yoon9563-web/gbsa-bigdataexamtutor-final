# 학습 기록

신규 세션은 state.template.json을 복사해 learners/<학습ID>/state.json으로 저장한다. 이 파일을 재개의 기준으로 사용한다. 학습자 실명 없이 ID만 쓰고, 다른 학습자의 기록은 열지 않는다.

- profile에 실제 가용일·시간·목표를, diagnosis에 유형별 수준과 진단 근거를 기록한다.
- plan.days 각 원소는 day, minutes, problem_ids, concepts를 가진다. problem_ids는 계획 전역에서 고유하게 배치한다. 각 문항에 type(1~3), title, concepts, minutes, source, status, hints_used, attempts, prompt, grading_key를 둔다. 생성 전이면 prompt와 grading_key는 null이다. 학습자 응답에 grading_key를 노출하지 않는다.
- status는 planned, active, independent_correct, assisted_correct, reviewed, skipped를 사용한다. 진단 문항은 plan 밖 diagnosis에 기록한다. active_problem_id는 최대 하나를 가리킨다. hints_used는 0~3이다. attempts에는 시각과 판정, 필요한 경우 채점 근거를 둔다.
- concept_evidence에 개념별 최근 독립/도움/복습 근거와 날짜를, review_queue에 복습 대상과 예정일을 기록한다. 재도전 문항은 새 ID를 부여하고 원본 ID를 보관한다.
- 한 번의 상호작용은 한 문항에만 적용한다. 같은 제출을 재전송하거나 이미 종료된 ID에 다시 답하면 진도와 채점 횟수를 중복 갱신하지 않는다. 다시 채점이 필요한 경우 사용자 요청에 따라 기록을 정정한다.
- 갱신 전 최신 상태를 읽고 JSON 구조와 ID 참조를 검증한다. 임시 파일에 먼저 기록하고 같은 폴더의 대상 파일로 교체한다. 다른 세션이 기록을 갱신한 경우 최신 버전을 읽고 변경 충돌을 확인한다. 진행률은 저장된 ID와 상태에서 계산한다.
