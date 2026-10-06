package com.example.taskapp.card;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * リスト（未着手・作業中・完了）。3つで固定のため、読み取り専用で扱う。
 */
@Entity
@Table(name = "list")
public class TaskList {

	@Id
	private String id;

	@Column(nullable = false)
	private String name;

	@Column(name = "display_order", nullable = false)
	private int displayOrder;

	protected TaskList() {
	}

	public String getId() {
		return id;
	}

	public String getName() {
		return name;
	}

	public int getDisplayOrder() {
		return displayOrder;
	}

}
