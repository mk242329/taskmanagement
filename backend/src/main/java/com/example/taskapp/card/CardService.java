package com.example.taskapp.card;

import java.util.ArrayList;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class CardService {

	private final CardRepository cardRepository;

	private final TaskListRepository taskListRepository;

	public CardService(CardRepository cardRepository, TaskListRepository taskListRepository) {
		this.cardRepository = cardRepository;
		this.taskListRepository = taskListRepository;
	}

	public List<CardResponse> findAll() {
		return cardRepository.findAllOrdered().stream()
				.map(CardResponse::from)
				.toList();
	}

	public CardResponse findById(Long id) {
		return cardRepository.findWithListById(id)
				.map(CardResponse::from)
				.orElseThrow(() -> notFound(id));
	}

	/**
	 * カードを追加する。追加先のリストの一番下に入る。
	 */
	@Transactional
	public CardResponse create(CardCreateRequest request) {
		String listId = request.listId() != null ? request.listId() : CardCreateRequest.DEFAULT_LIST_ID;
		TaskList list = taskListRepository.findById(listId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "リストが見つかりません（listId=" + listId + "）"));

		Card card = new Card(
				request.title(),
				request.description() != null ? request.description() : "",
				request.dueAt(),
				Boolean.TRUE.equals(request.strict()),
				list,
				cardRepository.findNextPosition(listId));
		return CardResponse.from(cardRepository.save(card));
	}

	/**
	 * カードのタイトル・説明文・期限・時間厳守を変更する。リストと並び順は変えない。
	 */
	@Transactional
	public CardResponse update(Long id, CardUpdateRequest request) {
		Card card = cardRepository.findWithListById(id)
				.orElseThrow(() -> notFound(id));
		card.update(
				request.title(),
				request.description() != null ? request.description() : "",
				request.dueAt(),
				Boolean.TRUE.equals(request.strict()));
		return CardResponse.from(card);
	}

	/**
	 * カードを指定したリストの指定した位置へ移す（同じリストなら並び替え）。
	 * 移動元・移動先のリストの並び順を 0 から詰め直し、移動後のカード一覧を返す。
	 */
	@Transactional
	public List<CardResponse> move(Long id, CardMoveRequest request) {
		Card card = cardRepository.findWithListById(id)
				.orElseThrow(() -> notFound(id));
		TaskList to = taskListRepository.findById(request.listId())
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "リストが見つかりません（listId=" + request.listId() + "）"));
		String fromListId = card.getList().getId();

		// 移動元のリストから外して詰め直す
		List<Card> fromCards = new ArrayList<>(cardRepository.findByListIdOrdered(fromListId));
		fromCards.removeIf(c -> c.getId().equals(id));
		renumber(fromCards);

		// 移動先のリストの指定した位置に入れて詰め直す（同じリストなら、外したあとの並びに入れる）
		List<Card> toCards = to.getId().equals(fromListId)
				? fromCards
				: new ArrayList<>(cardRepository.findByListIdOrdered(to.getId()));
		int position = request.position() == null ? toCards.size() : Math.min(request.position(), toCards.size());
		toCards.add(position, card);
		card.moveTo(to, position);
		renumber(toCards);

		cardRepository.flush();
		return findAll();
	}

	private static void renumber(List<Card> cards) {
		for (int i = 0; i < cards.size(); i++) {
			cards.get(i).renumber(i);
		}
	}

	private static ResponseStatusException notFound(Long id) {
		return new ResponseStatusException(HttpStatus.NOT_FOUND, "カードが見つかりません（id=" + id + "）");
	}

}
