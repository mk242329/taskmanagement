package com.example.taskapp.card;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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

}
