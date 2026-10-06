package com.example.taskapp.card;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
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

}
