# 프로젝트 제목
Node.js 를 이용한 라이브 채팅 서버 (Socket.io)

# 주요 특징
* DB 와의 연결을 통해 채팅 과거 히스토리, 현재 채팅방에 접속해있는 유저 목록 등을 조회, 수정, 삭제, 추가합니다. (추후 DB 연결 대신 Redis를 이용해 빠르게 처리 가능)
* Socket.io 의 웹소켓 기능을 이용하여 transport 기능을 이용하지 않습니다 : io.set('transports', ['websocket']);
* 방(Room)이 나눠집니다.
* 유저의 아이피를 가져올 수 있습니다: socket.handshake.headers["x-forwarded-for"] (아이피 가져오기)
* 매우 간단한 시스템으로 추후에 강제 퇴장, 채팅 금지 등의 기능도 추가 가능합니다.
