package com.example.taskapp.card;

import static org.hamcrest.Matchers.endsWith;
import static org.hamcrest.Matchers.hasSize;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
				INSERT INTO card (title, description, due_at, strict, list_id, position, notified) VALUES
				    ('完了したカード',   '',       NULL,                         false, 'done',  0, true),
				    ('作業中のカード',   '',       NULL,                         false, 'doing', 0, false),
				    ('未着手の2枚目',    '',       NULL,                         false, 'todo',  1, false),
				    ('未着手の1枚目',    '説明文', '2026-10-08 09:00:00+09',      true,  'todo',  0, false)
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
				.andExpect(jsonPath("$.notified").value(false))
				.andExpect(jsonPath("$.createdAt").isNotEmpty())
				.andExpect(jsonPath("$.updatedAt").isNotEmpty());
	}

	@Test
	void 存在しないidは404を返す() throws Exception {
		mockMvc.perform(get("/api/cards/999"))
				.andExpect(status().isNotFound());
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
				.andExpect(jsonPath("$.notified").value(false))
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
	void 期限を変えると通知済みを戻し_同じ時刻なら戻さない() throws Exception {
		jdbcTemplate.update("UPDATE card SET notified = true WHERE id = 4");

		// 時差の書き方が違うだけで同じ時刻
		mockMvc.perform(put("/api/cards/4")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"title": "未着手の1枚目", "dueAt": "2026-10-08T00:00:00Z"}
						"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.notified").value(true));

		mockMvc.perform(put("/api/cards/4")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"title": "未着手の1枚目", "dueAt": "2026-10-09T00:00:00Z"}
						"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.notified").value(false));
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

	private int countCards() {
		return jdbcTemplate.queryForObject("SELECT count(*) FROM card", Integer.class);
	}

}
