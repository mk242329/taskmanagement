-- リスト（3つで固定。アプリからは追加・変更・削除しない）
CREATE TABLE list (
    id            VARCHAR(10) PRIMARY KEY,
    name          VARCHAR(10) NOT NULL,
    display_order INTEGER     NOT NULL
);

INSERT INTO list (id, name, display_order) VALUES
    ('todo',  '未着手', 1),
    ('doing', '作業中', 2),
    ('done',  '完了',   3);

-- カード
CREATE TABLE card (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title       VARCHAR(50)  NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    due_at      TIMESTAMPTZ,
    strict      BOOLEAN      NOT NULL DEFAULT false,
    list_id     VARCHAR(10)  NOT NULL DEFAULT 'todo' REFERENCES list (id),
    position    INTEGER      NOT NULL,
    notified    BOOLEAN      NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
