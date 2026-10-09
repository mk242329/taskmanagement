package com.example.taskapp.card;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * カード。
 */
@Entity
@Table(name = "card")
public class Card {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false)
	private String title;

	@Column(nullable = false)
	private String description;

	@Column(name = "due_at")
	private OffsetDateTime dueAt;

	@Column(nullable = false)
	private boolean strict;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "list_id", nullable = false)
	private TaskList list;

	@Column(nullable = false)
	private int position;

	@Column(name = "created_at", nullable = false)
	private OffsetDateTime createdAt;

	@Column(name = "updated_at", nullable = false)
	private OffsetDateTime updatedAt;

	protected Card() {
	}

	public Card(String title, String description, OffsetDateTime dueAt, boolean strict, TaskList list, int position) {
		// GET で返す日時（DB から読んだもの）と形をそろえるため、UTC で作る
		OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
		this.title = title;
		this.description = description;
		this.dueAt = dueAt;
		this.strict = strict;
		this.list = list;
		this.position = position;
		this.createdAt = now;
		this.updatedAt = now;
	}

	/**
	 * タイトル・説明文・期限・時間厳守を変更する。
	 */
	public void update(String title, String description, OffsetDateTime dueAt, boolean strict) {
		this.title = title;
		this.description = description;
		this.dueAt = dueAt;
		this.strict = strict;
		this.updatedAt = OffsetDateTime.now(ZoneOffset.UTC);
	}

	/**
	 * 別のリスト・別の位置へ移す。
	 */
	public void moveTo(TaskList list, int position) {
		this.list = list;
		this.position = position;
		this.updatedAt = OffsetDateTime.now(ZoneOffset.UTC);
	}

	/**
	 * ほかのカードの移動に合わせて、リスト内の並び順を詰め直す。カードの内容は変わらないため、更新日時は変えない。
	 */
	void renumber(int position) {
		this.position = position;
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

	public TaskList getList() {
		return list;
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
