-- 開発用のサンプルカード
-- 何度実行しても同じ状態になるよう、既存のカードを消してから入れ直す（id も 1 から振り直す）
-- 期限は実行した時刻からの相対値にして、期限切れ・今日・近日・期限なしがそろうようにしている
--
-- 実行方法（リポジトリのルートで）：
--   docker compose exec -T db psql -U taskapp -d taskapp < backend/seed/sample-cards.sql

BEGIN;

TRUNCATE card RESTART IDENTITY;

INSERT INTO card (title, description, due_at, strict, list_id, position, notified) VALUES
    ('要件定義書を見直す',       '機能要件の抜け漏れを確認する',     now() + interval '3 days',  false, 'todo',  0, false),
    ('API 設計をまとめる',       'エンドポイントと JSON の形を決める', now() + interval '2 hours', true,  'todo',  1, false),
    ('Java の復習',             '',                                 NULL,                       false, 'todo',  2, false),
    ('カード一覧 API を実装する', 'GET /api/cards',                   now() + interval '1 day',   false, 'doing', 0, false),
    ('週報を提出する',           '先週分の週報',                      now() - interval '1 day',   true,  'doing', 1, true),
    ('開発環境を作る',           'Docker Compose で PostgreSQL を起動', now() - interval '2 days', false, 'done',  0, true);

COMMIT;
