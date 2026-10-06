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

	public CardService(CardRepository cardRepository) {
		this.cardRepository = cardRepository;
	}

	public List<CardResponse> findAll() {
		return cardRepository.findAllOrdered().stream()
				.map(CardResponse::from)
				.toList();
	}

	public CardResponse findById(Long id) {
		return cardRepository.findWithListById(id)
				.map(CardResponse::from)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "カードが見つかりません（id=" + id + "）"));
	}

}
