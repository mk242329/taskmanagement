package com.example.taskapp.card;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

/**
 * カードの移動・並び替え API で受け取る内容。
 * position は移した先のリストの中での順番（0 が一番上）。省略するか、リストの枚数以上なら一番下に入る。
 */
public record CardMoveRequest(
		@NotBlank(message = "移動先のリストを指定してください")
		String listId,

		@Min(value = 0, message = "並び順は0以上で指定してください")
		Integer position) {

}
