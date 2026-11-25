# QuizArena Live — Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Identity & Verification Invariant**: Every read and write on user profiles, saved quizzes, rooms, host data, players, and answers requires an authenticated user with a verified email (`request.auth != null && request.auth.token.email_verified == true`).
2. **PII Isolation Invariant**: User email addresses and account details live exclusively under `/users/{userId}` and are readable/writable only by `userId == request.auth.uid`. Public room state (`/rooms/{roomCode}`), player docs (`/rooms/{roomCode}/players/{playerId}`), and answers contain zero PII.
3. **Host Authority & Answer Key Isolation**: Quiz answer keys (`correctIndex` for all questions) live under `/rooms/{roomCode}/hostData/{docId}` readable only by `hostUid`. During `phase == 'QUESTION'`, `rooms/{roomCode}.currentQuestion` must omit `correctIndex`.
4. **Score Integrity Invariant (Tiered Identity)**: Players can only create their own player doc with zeroed initial stats (`score == 0`, `streak == 0`, `bestStreak == 0`, `correctCount == 0`, `answeredCount == 0`, `lastPoints == 0`, `lastCorrect == null`, `lastChoice == null`, `rank == 1`) and may only update `name`, `avatarId`, `connected`, and `updatedAt`. Only the Room Host (`hostUid`) may update player scores, streaks, and ranks.
5. **Immutable Single-Submission Answer Invariant**: Answer IDs must equal `${questionIndex}_${request.auth.uid}` and can only be created once while the parent room exists in `phase == 'QUESTION'` for the matching `currentQuestionIndex`. Updates to existing answers are forbidden (`allow update: if false`).
6. **200-Player Capacity & Terminal Lock**: Rooms cap `totalPlayers <= 200` and `leaderboard.size() <= 200`. Once a room reaches `phase == 'ENDED'`, no further updates to the room, its players, or its answers are permitted.
7. **Server Timestamp Integrity**: `createdAt`, `updatedAt`, `joinedAt`, and `submittedAt` must equal `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Room Create**: `request.auth == null` creating `/rooms/4829` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof**: `request.auth.token.email_verified == false` writing `/users/{uid}` -> `PERMISSION_DENIED`.
3. **Host UID Spoofing**: Creating `/rooms/4829` with `hostUid: "victim-uid"` != `request.auth.uid` -> `PERMISSION_DENIED`.
4. **Ghost Field / Shadow Update**: Creating or updating `/rooms/4829/players/{uid}` with extra field `isAdmin: true` -> `PERMISSION_DENIED`.
5. **Self-Awarded Score Cheat**: Player updating own `/rooms/4829/players/{uid}` with `score: 99999` or `rank: 1` -> `PERMISSION_DENIED`.
6. **Leaking Correct Answer Early**: Host updating `/rooms/4829` to `phase: "QUESTION"` with `currentQuestion.correctIndex: 1` -> `PERMISSION_DENIED`.
7. **Non-Host Answer Key Snooping**: Player calling `get` on `/rooms/4829/hostData/quiz` -> `PERMISSION_DENIED`.
8. **Answer Spoof / Double Submit**: Player creating `/rooms/4829/answers/0_otherUid` or submitting for `questionIndex: 2` when room is on `currentQuestionIndex: 0` -> `PERMISSION_DENIED`.
9. **Answer Mutation After Lock**: Player updating `/rooms/4829/answers/0_{uid}` to change `choice` -> `PERMISSION_DENIED`.
10. **PII Cross-User Read**: User A calling `get` on `/users/userB` -> `PERMISSION_DENIED`.
11. **Room Capacity / Oversized ID Poisoning**: Creating `/rooms/invalid_123456` or `/rooms/4829/players/{uid}` when `room.totalPlayers >= 200` or `name.length > 24` -> `PERMISSION_DENIED`.
12. **Post-ENDED Terminal Mutation**: Host or player attempting to mutate `/rooms/4829` or `/rooms/4829/players/{uid}` after `existing().phase == 'ENDED'` -> `PERMISSION_DENIED`.
