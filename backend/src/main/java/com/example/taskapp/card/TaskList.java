package com.example.taskapp.card;

import java.util.List;
import java.util.Optional;

/**
 * リスト（未着手・作業中・完了）。3つで固定のため、DB には置かずコードで持つ。
 */
public record TaskList(String id, String name, int displayOrder) {

	/** すべてのリスト（表示順） */
	public static final List<TaskList> ALL = List.of(
			new TaskList("todo", "未着手", 1),
			new TaskList("doing", "作業中", 2),
			new TaskList("done", "完了", 3));

	public static Optional<TaskList> findById(String id) {
		return ALL.stream().filter(list -> list.id().equals(id)).findFirst();
	}

	/** リストの表示順。存在しないリストは一番うしろにする */
	static int displayOrderOf(String id) {
		return findById(id).map(TaskList::displayOrder).orElse(Integer.MAX_VALUE);
	}

}
