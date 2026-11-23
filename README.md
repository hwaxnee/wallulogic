# 월루로직 웹앱

Next.js App Router + Supabase 기반 네모로직 웹앱입니다.

## 현재 구현
- 홈 → 게임 방법 → 난이도 선택 → 게임 → 완료 흐름
- 초고수 모바일 잠금
- 이메일 회원가입/로그인
- `get_random_puzzle` RPC로 랜덤 문제 호출
- 비로그인: `check_puzzle_answer`로 정답 판정
- 로그인: `complete_puzzle`로 정답 판정과 완료 기록 저장
- 문제번호 6자리 표시, 타이머, 채우기/X, 드래그, 실행취소
- 완료 후 공유(Web Share API 또는 링크 복사)

## 0. 공유 문제 RPC 추가
Supabase SQL Editor에서 `supabase/migrations/002_shared_puzzle.sql` 전체를 한 번 실행합니다. 공유 링크로 특정 문제를 여는 기능에 필요합니다.

## 1. 환경 변수
`.env.example`을 복사해 `.env.local`로 이름을 바꾸고 Supabase Connect 화면의 값을 입력합니다.

NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...

`.env.local`은 GitHub에 올리지 마세요.

## 2. 로컬 실행
Node.js 20 이상 권장.

npm install
npm run dev

브라우저에서 http://localhost:3000 접속.

## 3. Vercel 배포
1. 이 폴더를 GitHub 저장소에 업로드
2. Vercel에서 Add New > Project > 저장소 Import
3. Environment Variables에 위의 두 값을 각각 등록
4. Deploy

## 4. Supabase 인증 설정
Authentication > URL Configuration에서:
- Site URL: Vercel 운영 주소
- Redirect URLs: `http://localhost:3000/**`와 `https://운영주소/**`

테스트 계정은 이미 생성했더라도 웹앱 로그인에는 이메일/비밀번호가 필요합니다.

## 5. 현재 DB 상태 주의
현재 초보자 #000001만 등록되어 있으므로 다른 난이도는 "등록된 문제가 없음" 안내가 정상입니다.

## 6. 다음 권장 작업
- 중간 저장용 plays upsert RPC
- 완료 컬렉션 페이지
- 검증된 퍼즐 일괄 import 도구
- `get_random_puzzle`에서 임의 target_user_id를 받지 않고 auth.uid()만 사용하도록 보안 강화
