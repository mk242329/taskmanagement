package com.example.taskapp.card;

import java.time.OffsetDateTime;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * カード追加 API で受け取る内容。
 * 説明文・期限・時間厳守・追加先のリストは省略できる。
 */
public record CardCreateRequest(
		@NotBlank(message = "タイトルを入力してください")
		@Size(max = 50, message = "タイトルは50文字以内で入力してください")
		String title,

		@Size(max = 500, message = "説明文は500文字以内で入力してください")
		String description,

		OffsetDateTime dueAt,

		Boolean strict,

		String listId) {

	/** 追加先のリストを省略したときに入れるリスト */
	static final String DEFAULT_LIST_ID = "todo";

}
