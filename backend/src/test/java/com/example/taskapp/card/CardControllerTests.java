package com.example.taskapp.card;

import static org.hamcrest.Matchers.endsWith;
import static org.hamcrest.Matchers.hasSize;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import com.example.taskapp.TestcontainersConfiguration;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class CardControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@BeforeEach
	void setUp() {
		jdbcTemplate.execute("TRUNCATE card RESTART IDENTITY");
		// わざと表示順と違う順番で入れる
		jdbcTemplate.update("""
				INSERT INTO card (title, description, due_at, strict, list_id, position) VALUES
				    ('完了したカード',   '',       NULL,                         false, 'done',  0),
				    ('作業中のカード',   '',       NULL,                         false, 'doing', 0),
				    ('未着手の2枚目',    '',       NULL,                         false, 'todo',  1),
				    ('未着手の1枚目',    '説明文', '2026-10-08 09:00:00+09',      true,  'todo',  0)
				""");
	}

	@Test
	void カード一覧をリストの表示順とリスト内の並び順で返す() throws Exception {
		mockMvc.perform(get("/api/cards"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(4)))
				.andExpect(jsonPath("$[0].title").value("未着手の1枚目"))
				.andExpect(jsonPath("$[0].listId").value("todo"))
				.andExpect(jsonPath("$[0].position").value(0))
				.andExpect(jsonPath("$[1].title").value("未着手の2枚目"))
				.andExpect(jsonPath("$[2].title").value("作業中のカード"))
				.andExpect(jsonPath("$[2].listId").value("doing"))
				.andExpect(jsonPath("$[3].title").value("完了したカード"))
				.andExpect(jsonPath("$[3].listId").value("done"));
	}

	@Test
	void カードがないときは空の配列を返す() throws Exception {
		jdbcTemplate.execute("TRUNCATE card");

		mockMvc.perform(get("/api/cards"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(0)));
	}

	@Test
	void idを指定してカードを1件返す() throws Exception {
		mockMvc.perform(get("/api/cards/4"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(4))
				.andExpect(jsonPath("$.title").value("未着手の1枚目"))
				.andExpect(jsonPath("$.description").value("説明文"))
				.andExpect(jsonPath("$.dueAt").isNotEmpty())
				.andExpect(jsonPath("$.strict").value(true))
				.andExpect(jsonPath("$.listId").value("todo"))
				.andExpect(jsonPath("$.createdAt").isNotEmpty())
				.andExpect(jsonPath("$.updatedAt").isNotEmpty());
	}

	@Test
	void 存在しないidは404を返す() throws Exception {
		mockMvc.perform(get("/api/cards/999"))
				.andExpect(status().isNotFound());
	}

	@Test
	void idが数字でないときは400とエラーメッセージを返す() throws Exception {
		mockMvc.perform(get("/api/cards/abc"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("送られた内容を読み取れません"))
				.andExpect(jsonPath("$.errors").isMap());
	}

	@Test
	void 使えないメソッドは405とエラーメッセージを返す() throws Exception {
		mockMvc.perform(post("/api/cards/1/move"))
				.andExpect(status().isMethodNotAllowed())
				.andExpect(jsonPath("$.message").value("リクエストを処理できません（405）"))
				.andExpect(jsonPath("$.errors").isMap());
	}

	@Test
	void カードを追加するとリストの一番下に入り201と追加したカードを返す() throws Exception {
		mockMvc.perform(post("/api/cards")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"title": "課題A", "description": "第3章", "dueAt": "2026-10-08T18:00:00+09:00", "strict": true}
						"""))
				.andExpect(status().isCreated())
				.andExpect(header().string("Location", "/api/cards/5"))
				.andExpect(jsonPath("$.id").value(5))
				.andExpect(jsonPath("$.title").value("課題A"))
				.andExpect(jsonPath("$.description").value("第3章"))
				.andExpect(jsonPath("$.dueAt").value("2026-10-08T09:00:00Z"))
				.andExpect(jsonPath("$.strict").value(true))
				.andExpect(jsonPath("$.listId").value("todo"))
				.andExpect(jsonPath("$.position").value(2))
				.andExpect(jsonPath("$.createdAt").value(endsWith("Z")))
				.andExpect(jsonPath("$.updatedAt").value(endsWith("Z")));

		// 一覧でも未着手の一番下に出る
		mockMvc.perform(get("/api/cards"))
				.andExpect(jsonPath("$", hasSize(5)))
				.andExpect(jsonPath("$[2].title").value("課題A"));
	}

	@Test
	void タイトルだけでカードを追加でき省略した項目は初期値になる() throws Exception {
		mockMvc.perform(post("/api/cards")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"title": "課題B"}
						"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.description").value(""))
				.andExpect(jsonPath("$.dueAt").isEmpty())
				.andExpect(jsonPath("$.strict").value(false))
				.andExpect(jsonPath("$.listId").value("todo"));
	}

	@Test
	void 追加先のリストを指定できる() throws Exception {
		mockMvc.perform(post("/api/cards")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"title": "作業中に追加", "listId": "doing"}
						"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.listId").value("doing"))
				.andExpect(jsonPath("$.position").value(1));
	}

	@Test
	void カードがないリストに追加すると並び順は0になる() throws Exception {
		jdbcTemplate.execute("TRUNCATE card");

		mockMvc.perform(post("/api/cards")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"title": "最初のカード"}
						"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.position").value(0));
	}

	@Test
	void タイトルが空白だけのときは400とエラーメッセージを返し保存しない() throws Exception {
		mockMvc.perform(post("/api/cards")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"title": "   "}
						"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors.title").value("タイトルを入力してください"));

		assertThat(countCards()).isEqualTo(4);
	}

	@Test
	void タイトルがないときは400を返す() throws Exception {
		mockMvc.perform(post("/api/cards")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors.title").value("タイトルを入力してください"));
	}

	@Test
	void タイトルは50文字まで追加でき51文字は400を返す() throws Exception {
		mockMvc.perform(post("/api/cards")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"title\": \"" + "あ".repeat(50) + "\"}"))
				.andExpect(status().isCreated());

		mockMvc.perform(post("/api/cards")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"title\": \"" + "あ".repeat(51) + "\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors.title").value("タイトルは50文字以内で入力してください"));
	}

	@Test
	void 説明文は500文字まで追加でき501文字は400を返す() throws Exception {
		mockMvc.perform(post("/api/cards")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"title\": \"課題\", \"description\": \"" + "あ".repeat(500) + "\"}"))
				.andExpect(status().isCreated());

		mockMvc.perform(post("/api/cards")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"title\": \"課題\", \"description\": \"" + "あ".repeat(501) + "\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors.description").value("説明文は500文字以内で入力してください"));
	}

	@Test
	void 存在しないリストを指定すると400を返し保存しない() throws Exception {
		mockMvc.perform(post("/api/cards")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"title": "課題", "listId": "unknown"}
						"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("リストが見つかりません（listId=unknown）"));

		assertThat(countCards()).isEqualTo(4);
	}

	@Test
	void 期限の日時が読めないときは400を返す() throws Exception {
		mockMvc.perform(post("/api/cards")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"title": "課題", "dueAt": "あした"}
						"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("送られた内容を読み取れません"));
	}

	@Test
	void カードを編集すると200と編集後のカードを返しリストと並び順は変えない() throws Exception {
		mockMvc.perform(put("/api/cards/3")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"title": "編集後", "description": "説明", "dueAt": "2026-10-20T18:00:00+09:00", "strict": true}
						"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(3))
				.andExpect(jsonPath("$.title").value("編集後"))
				.andExpect(jsonPath("$.description").value("説明"))
				.andExpect(jsonPath("$.dueAt").value("2026-10-20T09:00:00Z"))
				.andExpect(jsonPath("$.strict").value(true))
				.andExpect(jsonPath("$.listId").value("todo"))
				.andExpect(jsonPath("$.position").value(1));

		// 保存されていて、一覧の並びも変わらない
		mockMvc.perform(get("/api/cards"))
				.andExpect(jsonPath("$[1].id").value(3))
				.andExpect(jsonPath("$[1].title").value("編集後"));
	}

	@Test
	void 編集で省略した項目は空_期限なし_時間厳守なしになる() throws Exception {
		mockMvc.perform(put("/api/cards/4")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"title": "タイトルだけ"}
						"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.description").value(""))
				.andExpect(jsonPath("$.dueAt").isEmpty())
				.andExpect(jsonPath("$.strict").value(false));
	}

	@Test
	void 編集でタイトルに誤りがあるときは400を返し保存しない() throws Exception {
		mockMvc.perform(put("/api/cards/4")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"title": "  "}
						"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors.title").value("タイトルを入力してください"));

		mockMvc.perform(put("/api/cards/4")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"title\": \"" + "あ".repeat(51) + "\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors.title").value("タイトルは50文字以内で入力してください"));

		mockMvc.perform(get("/api/cards/4"))
				.andExpect(jsonPath("$.title").value("未着手の1枚目"));
	}

	@Test
	void 存在しないカードを編集すると404を返す() throws Exception {
		mockMvc.perform(put("/api/cards/999")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"title": "課題"}
						"""))
				.andExpect(status().isNotFound());
	}

	@Test
	void 別のリストへ移すと移動先の指定した位置に入り移動後の一覧を返す() throws Exception {
		// 未着手の1枚目（id=4）を作業中の一番上へ
		mockMvc.perform(patch("/api/cards/4/move")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"listId": "doing", "position": 0}
						"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(4)))
				.andExpect(jsonPath("$[0].id").value(3))
				.andExpect(jsonPath("$[0].position").value(0))
				.andExpect(jsonPath("$[1].id").value(4))
				.andExpect(jsonPath("$[1].listId").value("doing"))
				.andExpect(jsonPath("$[1].position").value(0))
				.andExpect(jsonPath("$[2].id").value(2))
				.andExpect(jsonPath("$[2].position").value(1))
				.andExpect(jsonPath("$[3].id").value(1));

		// 保存されている
		assertThat(positions("todo")).containsExactly("3:0");
		assertThat(positions("doing")).containsExactly("4:0", "2:1");
	}

	@Test
	void 並び順を省略すると移動先の一番下に入る() throws Exception {
		mockMvc.perform(patch("/api/cards/4/move")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"listId": "done"}
						"""))
				.andExpect(status().isOk());

		assertThat(positions("done")).containsExactly("1:0", "4:1");
	}

	@Test
	void 並び順がリストの枚数より大きいときは一番下に入る() throws Exception {
		mockMvc.perform(patch("/api/cards/4/move")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"listId": "doing", "position": 99}
						"""))
				.andExpect(status().isOk());

		assertThat(positions("doing")).containsExactly("2:0", "4:1");
	}

	@Test
	void 同じリストの中で並び替えられる() throws Exception {
		jdbcTemplate.update("INSERT INTO card (title, list_id, position) VALUES ('未着手の3枚目', 'todo', 2)");

		// 一番下（id=5）を一番上へ
		mockMvc.perform(patch("/api/cards/5/move")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"listId": "todo", "position": 0}
						"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].id").value(5))
				.andExpect(jsonPath("$[1].id").value(4))
				.andExpect(jsonPath("$[2].id").value(3));

		assertThat(positions("todo")).containsExactly("5:0", "4:1", "3:2");

		// 一番上（id=5）を一番下へ
		mockMvc.perform(patch("/api/cards/5/move")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"listId": "todo", "position": 2}
						"""))
				.andExpect(status().isOk());

		assertThat(positions("todo")).containsExactly("4:0", "3:1", "5:2");
	}

	@Test
	void 移動で存在しないリストや誤った並び順を指定すると400を返し移さない() throws Exception {
		mockMvc.perform(patch("/api/cards/4/move")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"listId": "unknown"}
						"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("リストが見つかりません（listId=unknown）"));

		mockMvc.perform(patch("/api/cards/4/move")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors.listId").value("移動先のリストを指定してください"));

		mockMvc.perform(patch("/api/cards/4/move")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"listId": "doing", "position": -1}
						"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors.position").value("並び順は0以上で指定してください"));

		assertThat(positions("todo")).containsExactly("4:0", "3:1");
	}

	@Test
	void 存在しないカードを移すと404を返す() throws Exception {
		mockMvc.perform(patch("/api/cards/999/move")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"listId": "doing"}
						"""))
				.andExpect(status().isNotFound());
	}

	@Test
	void カードを削除すると204を返し残ったカードの並び順を詰め直す() throws Exception {
		jdbcTemplate.update("INSERT INTO card (title, list_id, position) VALUES ('未着手の3枚目', 'todo', 2)");

		// 未着手の1枚目（id=4）を削除
		mockMvc.perform(delete("/api/cards/4"))
				.andExpect(status().isNoContent());

		mockMvc.perform(get("/api/cards/4"))
				.andExpect(status().isNotFound());
		assertThat(countCards()).isEqualTo(4);
		assertThat(positions("todo")).containsExactly("3:0", "5:1");
		// ほかのリストは変わらない
		assertThat(positions("doing")).containsExactly("2:0");
	}

	@Test
	void 存在しないカードを削除すると404を返す() throws Exception {
		mockMvc.perform(delete("/api/cards/999"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.message").value("カードが見つかりません（id=999）"));

		assertThat(countCards()).isEqualTo(4);
	}

	/** リストのカードを並び順に「id:並び順」の形で返す */
	private List<String> positions(String listId) {
		return jdbcTemplate.queryForList(
				"SELECT id || ':' || position FROM card WHERE list_id = ? ORDER BY position, id", String.class, listId);
	}

	private int countCards() {
		return jdbcTemplate.queryForObject("SELECT count(*) FROM card", Integer.class);
	}

}
