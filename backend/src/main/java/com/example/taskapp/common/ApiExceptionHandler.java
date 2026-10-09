package com.example.taskapp.common;

import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.TypeMismatchException;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

/**
 * API のエラーを、画面で扱いやすい同じ形の JSON にそろえて返す。
 *
 * <pre>
 * { "message": "入力内容に誤りがあります", "errors": { "title": "タイトルを入力してください" } }
 * </pre>
 */
@RestControllerAdvice
public class ApiExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

	public record ErrorResponse(String message, Map<String, String> errors) {
	}

	/** 入力チェック（Bean Validation）の誤り。項目ごとのメッセージを返す */
	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException e) {
		Map<String, String> errors = new LinkedHashMap<>();
		for (FieldError fieldError : e.getBindingResult().getFieldErrors()) {
			// 1 つの項目に複数の誤りがあるときは、最初のものだけを返す
			errors.putIfAbsent(fieldError.getField(), fieldError.getDefaultMessage());
		}
		return ResponseEntity.badRequest().body(new ErrorResponse("入力内容に誤りがあります", errors));
	}

	/** JSON の形が正しくない（期限の日時が読めないなど） */
	@ExceptionHandler(HttpMessageNotReadableException.class)
	public ResponseEntity<ErrorResponse> handleNotReadable(HttpMessageNotReadableException e) {
		return ResponseEntity.badRequest().body(new ErrorResponse("送られた内容を読み取れません", Map.of()));
	}

	/** サービスで判定したエラー（存在しないカード・リストなど） */
	@ExceptionHandler(ResponseStatusException.class)
	public ResponseEntity<ErrorResponse> handleResponseStatus(ResponseStatusException e) {
		HttpStatus status = HttpStatus.valueOf(e.getStatusCode().value());
		String message = e.getReason() != null ? e.getReason() : status.getReasonPhrase();
		return ResponseEntity.status(status).body(new ErrorResponse(message, Map.of()));
	}

	/** URL の id が数字でないなど、送られた値の型が正しくない */
	@ExceptionHandler(TypeMismatchException.class)
	public ResponseEntity<ErrorResponse> handleTypeMismatch(TypeMismatchException e) {
		return ResponseEntity.badRequest().body(new ErrorResponse("送られた内容を読み取れません", Map.of()));
	}

	/**
	 * ほかのハンドラで扱わないエラー。Spring の既定の形では message が入らず、画面に理由を出せないため、ここでそろえる。
	 * 存在しない URL・使えないメソッドなどはその状態コードのまま返し、それ以外（DB に接続できないなど）は 500 にする
	 */
	@ExceptionHandler(Exception.class)
	public ResponseEntity<ErrorResponse> handleOther(Exception e) {
		if (e instanceof org.springframework.web.ErrorResponse errorResponse) {
			HttpStatusCode status = errorResponse.getStatusCode();
			return ResponseEntity.status(status)
					.body(new ErrorResponse("リクエストを処理できません（" + status.value() + "）", Map.of()));
		}
		log.error("API の処理中に予期しないエラーが起きました", e);
		return ResponseEntity.internalServerError().body(new ErrorResponse("サーバーでエラーが起きました", Map.of()));
	}

}
