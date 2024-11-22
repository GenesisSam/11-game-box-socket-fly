[기획]
1. `socket.io`를 기반한 서버.
2. client 들은 모두 동일한 채널에 접속함.
3. 서버는 아래 이벤트를 채널에 접속한 모든 유저들에서 전송할 수 있음
   1. 이벤트를 보내기전에 `game` 데이터를 생성하고, `openedGames.csv` 에 저장함.
```
event name: gameOpen
payload: {
  gameId: string;
  fixtureId: string;
  type: "poll-single" | "poll-multiple" | "vote" | "answer";
  content: string; // spec: markdown
  timeout: number; // default: 60 second. unit: seconds
  options: string[] | undefined;
}
```

4. 서버는 유저들로 부터 이벤트 `gameOpen` 에 대한 응답을 수집해서 아래 구조에 맞춰서 `userResponse.csv`에 저장함.
```
interface UserResponse {
  gameId: string;
  fixtureId: string;
  userId: string;
  userName: string;
  answer: string;
}
```

5. 서버는 유저들로 부터 이벤트 `gameStatus` 에 대한 요청을 받을 수 있다
   1. 요청받을때 gameId를 항상 같이 받는다.
   2. 해당 게임의 `type` 이 "vote", "poll-single" | "poll-multiple" 일때는, userResponse.csv에서 해당 게임에 대한 응답들을 집계하여 `options`별 총투표 또는 참가인원중 몇 퍼센트정도 투표했는지 알 수 있게 응답을 되돌려준다.

`gameStatus` 이벤트에 대한 로직을 아래 기획 내용을 기반으로 보강해줘
```
1. `openedGames.csv` 에서 입력받은 `gameId` 와 동일한 게임을 가져옴 => `gameObject `
2. `gameObject ` 에서 `type`을 검사해서 vote, poll-single, poll-multiple 일때만 응답을 보내줌.
3. (2) 에 조건에 부합할때, `userResponse.csv` 에서 입력받은 `gameId` 에 해당 하는 모든 응답을 수집하고, 도출 가능한 통계지표들을 반환해줌.
```

