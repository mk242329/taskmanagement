package com.example.taskapp.card;

import java.time.OffsetDateTime;

/**
 * API で返すカードの内容。
 */
public record CardResponse(
		Long id,
		String title,
		String description,
		OffsetDateTime dueAt,
		boolean strict,
		String listId,
		int position,
		OffsetDateTime createdAt,
		OffsetDateTime updatedAt) {

	public static CardResponse from(Card card) {
		return new CardResponse(
				card.getId(),
				card.getTitle(),
				card.getDescription(),
				card.getDueAt(),
				card.isStrict(),
				card.getList().getId(),
				card.getPosition(),
				card.getCreatedAt(),
				card.getUpdatedAt());
	}

}
