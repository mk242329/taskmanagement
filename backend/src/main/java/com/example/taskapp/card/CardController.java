package com.example.taskapp.card;

import java.net.URI;
import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/cards")
public class CardController {

	private final CardService cardService;

	public CardController(CardService cardService) {
		this.cardService = cardService;
	}

	/**
	 * カード一覧の取得。リストの表示順 → リスト内の並び順で返す。
	 */
	@GetMapping
	public List<CardResponse> findAll() {
		return cardService.findAll();
	}

	/**
	 * カード 1 件の取得。存在しない id は 404 を返す。
	 */
	@GetMapping("/{id}")
	public CardResponse findById(@PathVariable Long id) {
		return cardService.findById(id);
	}

	/**
	 * カードの追加。追加したカードを 201 で返す。入力に誤りがあれば 400 を返す。
	 */
	@PostMapping
	public ResponseEntity<CardResponse> create(@Valid @RequestBody CardCreateRequest request) {
		CardResponse created = cardService.create(request);
		return ResponseEntity.created(URI.create("/api/cards/" + created.id())).body(created);
	}

	/**
	 * カードの編集。編集後のカードを返す。入力に誤りがあれば 400、存在しない id は 404 を返す。
	 */
	@PutMapping("/{id}")
	public CardResponse update(@PathVariable Long id, @Valid @RequestBody CardUpdateRequest request) {
		return cardService.update(id, request);
	}

	/**
	 * カードの移動・並び替え。移動後のカード一覧を返す。
	 * 入力に誤りがあるか存在しないリストなら 400、存在しないカードは 404 を返す。
	 */
	@PatchMapping("/{id}/move")
	public List<CardResponse> move(@PathVariable Long id, @Valid @RequestBody CardMoveRequest request) {
		return cardService.move(id, request);
	}

}
