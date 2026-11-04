package com.example.taskapp.card;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CardService {

	/** リストの表示順 → リスト内の並び順 → id */
	private static final Comparator<Card> BOARD_ORDER = Comparator
			.comparingInt((Card card) -> TaskList.displayOrderOf(card.getListId()))
			.thenComparingInt(Card::getPosition)
			.thenComparing(Card::getId);

	private final CardRepository cardRepository;

	public CardService(CardRepository cardRepository) {
		this.cardRepository = cardRepository;
	}

	public List<CardResponse> findAll() {
		return cardRepository.findAll().stream()
				.sorted(BOARD_ORDER)
				.map(CardResponse::from)
				.toList();
	}

	public CardResponse findById(Long id) {
		return CardResponse.from(findCard(id));
	}

	/**
	 * カードを追加する。追加先のリストの一番下に入る。
	 */
	public CardResponse create(CardCreateRequest request) {
		String listId = request.listId() != null ? request.listId() : CardCreateRequest.DEFAULT_LIST_ID;
		TaskList list = findList(listId);

		Card card = new Card(
				cardRepository.nextId(),
				request.title(),
				request.description() != null ? request.description() : "",
				request.dueAt(),
				Boolean.TRUE.equals(request.strict()),
				list.id(),
				nextPosition(list.id()));
		cardRepository.save(card);
		return CardResponse.from(card);
	}

	/**
	 * カードのタイトル・説明文・期限・時間厳守を変更する。リストと並び順は変えない。
	 */
	public CardResponse update(Long id, CardUpdateRequest request) {
		Card card = findCard(id);
		card.update(
				request.title(),
				request.description() != null ? request.description() : "",
				request.dueAt(),
				Boolean.TRUE.equals(request.strict()));
		cardRepository.save(card);
		return CardResponse.from(card);
	}

	/**
	 * カードを指定したリストの指定した位置へ移す（同じリストなら並び替え）。
	 * 移動元・移動先のリストの並び順を 0 から詰め直し、移動後のカード一覧を返す。
	 */
	public List<CardResponse> move(Long id, CardMoveRequest request) {
		Card card = findCard(id);
		TaskList to = findList(request.listId());
		String fromListId = card.getListId();
		List<Card> changed = new ArrayList<>();

		// 移動元のリストから外して詰め直す
		List<Card> fromCards = cardsInList(fromListId);
		fromCards.removeIf(c -> c.getId().equals(id));
		renumber(fromCards, changed);

		// 移動先のリストの指定した位置に入れて詰め直す（同じリストなら、外したあとの並びに入れる）
		List<Card> toCards = to.id().equals(fromListId) ? fromCards : cardsInList(to.id());
		int position = request.position() == null ? toCards.size() : Math.min(request.position(), toCards.size());
		toCards.add(position, card);
		card.moveTo(to.id(), position);
		renumber(toCards, changed);
		if (!changed.contains(card)) {
			changed.add(card);
		}

		cardRepository.saveAll(changed, null);
		return findAll();
	}

	/**
	 * カードを削除する。残ったカードの並び順を 0 から詰め直す。
	 */
	public void delete(Long id) {
		Card card = findCard(id);
		List<Card> rest = cardsInList(card.getListId());
		rest.removeIf(c -> c.getId().equals(id));
		List<Card> changed = new ArrayList<>();
		renumber(rest, changed);
		cardRepository.saveAll(changed, id);
	}

	private Card findCard(Long id) {
		return cardRepository.findById(id).orElseThrow(() -> notFound(id));
	}

	private static TaskList findList(String listId) {
		return TaskList.findById(listId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "リストが見つかりません（listId=" + listId + "）"));
	}

	/** リストのカードを、リスト内の並び順で返す */
	private List<Card> cardsInList(String listId) {
		return new ArrayList<>(cardRepository.findAll().stream()
				.filter(card -> card.getListId().equals(listId))
				.sorted(BOARD_ORDER)
				.toList());
	}

	/** リスト内で次に使う並び順（一番下）。カードがなければ 0 */
	private int nextPosition(String listId) {
		return cardRepository.findAll().stream()
				.filter(card -> card.getListId().equals(listId))
				.mapToInt(card -> card.getPosition() + 1)
				.max()
				.orElse(0);
	}

	/** 並び順を 0 から振り直し、変わったカードを changed に足す（変わらないカードは保存し直さない） */
	private static void renumber(List<Card> cards, List<Card> changed) {
		for (int i = 0; i < cards.size(); i++) {
			if (cards.get(i).renumber(i) && !changed.contains(cards.get(i))) {
				changed.add(cards.get(i));
			}
		}
	}

	private static ResponseStatusException notFound(Long id) {
		return new ResponseStatusException(HttpStatus.NOT_FOUND, "カードが見つかりません（id=" + id + "）");
	}

}
