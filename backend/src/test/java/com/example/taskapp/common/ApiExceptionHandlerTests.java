package com.example.taskapp.common;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import com.example.taskapp.common.ApiExceptionHandler.ErrorResponse;

class ApiExceptionHandlerTests {

	private final ApiExceptionHandler handler = new ApiExceptionHandler();

	@Test
	void 予期しないエラーは500とエラーメッセージを返す() {
		// DB に接続できないときなど
		ResponseEntity<ErrorResponse> response = handler.handleOther(new IllegalStateException("接続できません"));

		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
		assertThat(response.getBody()).isNotNull();
		assertThat(response.getBody().message()).isEqualTo("サーバーでエラーが起きました");
		assertThat(response.getBody().errors()).isEmpty();
	}

}
