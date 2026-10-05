# 技術スタック

作成日：2026年10月5日

アプリを作るのに使う技術と、ファイルの構成をまとめる。

## 1. 使う技術

| 項目 | 内容 |
| --- | --- |
| 画面 | HTML + CSS + JavaScript（フレームワークは使わない） |
| ドラッグ＆ドロップ | [SortableJS](https://sortablejs.github.io/Sortable/)（CDN から読み込む） |
| データの保存 | ブラウザの localStorage |
| 通知 | ブラウザの Notification API |
| 動作確認 | VSCode の拡張機能「Live Server」でローカルサーバーを起動して開く |

ブラウザ通知はファイルを直接開いた状態（`file://`）では動かない場合があるため、Live Server を使って `http://localhost` で開く。

対応ブラウザなどの動作環境は [非機能要件](../requirements/non-functional.md) にまとめる。

## 2. ファイル構成

```text
taskmanagement/
├── index.html   … 画面の骨組み
├── style.css    … 見た目
├── script.js    … 動き（追加・編集・削除・移動・保存・通知）
└── docs/
    ├── requirements.md          … 要件定義書（全体のまとめ）
    ├── requirements/
    │   ├── features.md          … 機能一覧
    │   ├── functional.md        … 機能要件
    │   ├── non-functional.md    … 非機能要件
    │   └── screens.md           … 画面要件
    ├── design/
    │   ├── screen-design.md     … 画面設計
    │   ├── database.md          … データベース設計
    │   ├── data-flow.md         … データフロー
    │   └── tech-stack.md        … 技術スタック
    └── test-spec.md             … テスト仕様書
```
