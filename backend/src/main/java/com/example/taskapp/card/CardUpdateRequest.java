package com.example.taskapp.card;

import java.time.OffsetDateTime;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * カード編集 API で受け取る内容。
 * 説明文・期限・時間厳守は省略でき、省略したときは空・期限なし・時間厳守なしにする。
 */
public record CardUpdateRequest(
		@NotBlank(message = "タイトルを入力してください")
		@Size(max = 50, message = "タイトルは50文字以内で入力してください")
		String title,

		@Size(max = 500, message = "説明文は500文字以内で入力してください")
		String description,

		OffsetDateTime dueAt,

		Boolean strict) {

}
