# TripApp

**TripApp**은 Next.js와 Tailwind CSS로 만든 **AI 기반 여행 일정 플래너**입니다.  
사용자가 지역·기간·관심사를 입력하면 **Gemini**가 맞춤 일정을 생성하고, **Mapbox** 지도를 통해 장소를 한눈에 확인·편집할 수 있습니다.  
드래그로 순서를 바꾸고, 블록 단위로 재추천 및 대안 제안까지 받을 수 있습니다.

## ✨ 주요 기능

- 🧠 **AI 일정 생성 (Gemini)**  
  - `/api/generate`에서 **Zod 스키마**로 입력/출력 검증  
  - 모델이 반환한 JSON이 깨져도 수선하는 **loose JSON 파서** 내장

- 🗺 **지오코딩 & 좌표 보강 (Mapbox)**  
  - `/api/geo/resolve`, `/api/geo/batch`로 장소 좌표 자동 채움  
  - TripMap에서 **클러스터 / 아이콘 / 경로 라인** 표시 및 선택 하이라이트

- ✍️ **드래그 앤 드롭 편집**  
  - `@dnd-kit`으로 아이템 순서 변경 및 락(고정) 토글

- 🔄 **블록 재추천 & 대안 3개 제공**  
  - `/api/items/regen`, `/api/items/alternatives`  
  - 모델 출력은 Zod로 검증하여 정확한 개수 보장

- 💾 **입력 상태 로컬 저장**  
  - 최근 입력이 `localStorage`에 저장/복원되어 재방문 시 이어서 작성 가능

---

## 🧱 기술 스택

- **Framework**: Next.js 15 (App Router, Turbopack)  
- **UI**: Tailwind CSS  
- **AI**: Google **Gemini** (`@google/genai`)  
- **Map**: Mapbox GL JS  
- **Lang**: TypeScript  
- **Validation**: Zod  
- **DnD**: @dnd-kit/core, @dnd-kit/sortable

---

## ⚙️ 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 아래 내용을 채워주세요.

```env
# Gemini API Key (서버 전용)
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key

# Mapbox Token
MAPBOX_TOKEN=your_mapbox_server_token
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_public_token

# (선택) API 기본 URL 강제 지정 (프록시/프리뷰 용)
# NEXT_PUBLIC_BASE_URL=https://trip-app.example.com
```
---

## 🧭 설치 & 실행

```
git clone https://github.com/aidenjangkkj/trip-app-v2.git

cd trip-app-v2

npm install

npm run dev

npm run build

npm start
```
---

## 📜 NPM 스크립트
명령어	설명
npm run dev	개발 모드 실행 (HMR, Turbopack)
npm run build	프로덕션 빌드
npm start	프로덕션 서버 실행
npm run lint	ESLint 검사
npm run type-check	타입 검사 (옵션)

CRA 기반 스크립트(start/test/eject)가 아닌 Next.js 표준 스크립트를 사용합니다.

---

## 📂 폴더 구조 (요약)
src/
  app/
    page.tsx                        # 입력 스텝 → 일정 생성 → 결과 뷰
    api/
      generate/route.ts             # Gemini 호출 + Zod 검증
      geo/
        resolve/route.ts            # 단일 지오코딩
        batch/route.ts              # 다건 지오코딩
      items/
        regen/route.ts              # 블록 재추천 (1개)
        alternatives/route.ts       # 대안 3개
  components/
    DayBlock.tsx                    # 리스트 + DnD + 재추천/대안
    TripMap.tsx                     # 지도/클러스터/경로/선택
  lib/
    enrichCoords.ts                 # 좌표 보강 로직
    ensureItemIds.ts                # 누락된 id 생성
    prompt.ts                       # SYSTEM_PROMPT / USER_PROMPT
  types/
    trip.ts                         # TripInput/TripPlan 등 타입 + Zod 스키마
    
---

## 🌐 API 개요
Endpoint	기능	입출력 요약
POST /api/generate	일정 생성	입력: TripInput → 출력: TripPlan (Zod 검증)
POST /api/geo/resolve	단일 지오코딩	{ q, proximity?, language? } → { ok, lat?, lng? }
POST /api/geo/batch	다건 지오코딩	장소 목록 → ID별 좌표 맵 반환
POST /api/items/regen	블록 1개 재추천	{ dayIndex, item } → { item }
POST /api/items/alternatives	대안 3개 추천	{ dayIndex, item } → { candidates: TripItem[3] }

---

## 🚀 배포

https://trip-app-v2.vercel.app/

---

---

## ⚡ 성능

[https://trip-app-v2.vercel.app/](https://pagespeed.web.dev/analysis/https-trip-app-v2-vercel-app/iwa5zk3jlf?form_factor=mobile)
<img width="963" height="461" alt="캡처" src="https://github.com/user-attachments/assets/14ea2786-b950-474d-8b17-4a8d8ff5132d" />


---

## 📄 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.

---

