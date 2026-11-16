/*
  0035 장소 첨부 파일에 PDF (2026-11-16 마루님 "pdf까지 포함하고, pdf일때는 카드에 그림 안보여줘도돼")
  - 저장소 place-photos 가 PDF 도 받는다. 한 파일 10MB (그림은 올리기 전에 줄여서 대부분 1MB 안쪽)
  - 개수(장소마다 5개)와 권한은 그대로
*/
update storage.buckets set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], file_size_limit = 10485760
where id = 'place-photos';
