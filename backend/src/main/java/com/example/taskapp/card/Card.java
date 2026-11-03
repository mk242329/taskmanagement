package com.example.taskapp.card;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

/**
 * カード。日時はすべて UTC で持つ。
 */
public class Card {

	private final Long id;

	private String title;

	private String description;

	private OffsetDateTime dueAt;

	private boolean strict;

	private String listId;

	private int position;

	private final OffsetDateTime createdAt;

	private OffsetDateTime updatedAt;

	/**
	 * 新しいカードを作る。
	 */
	public Card(Long id, String title, String description, OffsetDateTime dueAt, boolean strict, String listId, int position) {
		this(id, title, description, dueAt, strict, listId, position, OffsetDateTime.now(ZoneOffset.UTC));
	}

	private Card(Long id, String title, String description, OffsetDateTime dueAt, boolean strict, String listId, int position,
			OffsetDateTime now) {
		this(id, title, description, dueAt, strict, listId, position, now, now);
	}

	/**
	 * 保存してあるカードを読み込むときに使う。
	 */
	Card(Long id, String title, String description, OffsetDateTime dueAt, boolean strict, String listId, int position,
			OffsetDateTime createdAt, OffsetDateTime updatedAt) {
		this.id = id;
		this.title = title;
		this.description = description;
		this.dueAt = toUtc(dueAt);
		this.strict = strict;
		this.listId = listId;
		this.position = position;
		this.createdAt = toUtc(createdAt);
		this.updatedAt = toUtc(updatedAt);
	}

	/**
	 * タイトル・説明文・期限・時間厳守を変更する。
	 */
	public void update(String title, String description, OffsetDateTime dueAt, boolean strict) {
		this.title = title;
		this.description = description;
		this.dueAt = toUtc(dueAt);
		this.strict = strict;
		this.updatedAt = OffsetDateTime.now(ZoneOffset.UTC);
	}

	/**
	 * 別のリスト・別の位置へ移す。
	 */
	public void moveTo(String listId, int position) {
		this.listId = listId;
		this.position = position;
		this.updatedAt = OffsetDateTime.now(ZoneOffset.UTC);
	}

	/**
	 * ほかのカードの移動に合わせて、リスト内の並び順を詰め直す。カードの内容は変わらないため、更新日時は変えない。
	 *
	 * @return 並び順が変わったら true（保存し直す必要がある）
	 */
	boolean renumber(int position) {
		if (this.position == position) {
			return false;
		}
		this.position = position;
		return true;
	}

	/** 送られた日時（+09:00 など）を、GET で返す形とそろえるため UTC にする */
	private static OffsetDateTime toUtc(OffsetDateTime dateTime) {
		return dateTime == null ? null : dateTime.withOffsetSameInstant(ZoneOffset.UTC);
	}

	public Long getId() {
		return id;
	}

	public String getTitle() {
		return title;
	}

	public String getDescription() {
		return description;
	}

	public OffsetDateTime getDueAt() {
		return dueAt;
	}

	public boolean isStrict() {
		return strict;
	}

	public String getListId() {
		return listId;
	}

	public int getPosition() {
		return position;
	}

	public OffsetDateTime getCreatedAt() {
		return createdAt;
	}

	public OffsetDateTime getUpdatedAt() {
		return updatedAt;
	}

}
