package com.example.taskapp.card;

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

	private static ResponseStatusException notFound(Long id) {
		return new ResponseStatusException(HttpStatus.NOT_FOUND, "カードが見つかりません（id=" + id + "）");
	}

}
