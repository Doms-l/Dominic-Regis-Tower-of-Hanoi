:- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_json)).
:- use_module(library(http/http_header)).
:- use_module(library(lists)).
:- use_module(library(apply)).
:- dynamic app_directory/1.
:- prolog_load_context(directory, Dir), asserta(app_directory(Dir)).

:- http_handler(root(.), serve_index, []).
:- http_handler(root('css/style.css'), serve_css, []).
:- http_handler(root('js/game.js'), serve_js, []).
:- http_handler(root('api/move'), api_move, [method(post)]).
:- http_handler(root('api/solve'), api_solve, [method(post)]).

static_file(Rel, Req, Mime) :-
    app_directory(Dir), directory_file_path(Dir, Rel, File),
    http_reply_file(File, [mime_type(Mime), unsafe(true)], Req).
serve_index(R) :- static_file('index.html', R, text(html)).
serve_css(R) :- static_file('css/style.css', R, text(css)).
serve_js(R) :- static_file('js/game.js', R, text/javascript).

valid_move(State, From, To, NewState) :-
    integer(From), integer(To), between(0,2,From), between(0,2,To), From =\= To,
    nth0(From, State, Source), nth0(To, State, Target), Source \= [],
    last(Source, Disk), append(SourceRest, [Disk], Source),
    (Target = [] ; last(Target, Top), Disk < Top),
    append(Target, [Disk], TargetNew),
    replace_nth0(From, State, SourceRest, Temp),
    replace_nth0(To, Temp, TargetNew, NewState).

replace_nth0(I, List, Value, Result) :-
    same_length(List, Result), nth0(I, List, _, Rest), nth0(I, Result, Value, Rest).

hanoi(0, _, _, _, []) :- !.
hanoi(N, From, To, Aux, Moves) :-
    N > 0, N1 is N-1,
    hanoi(N1, From, Aux, To, A),
    hanoi(N1, Aux, To, From, B),
    append(A, [move(From,To)|B], Moves).

api_move(Req) :-
    catch((http_read_json_dict(Req,D), State=D.state, From=D.from, To=D.to,
      (valid_move(State,From,To,New) -> reply_json_dict(_{valid:true,newState:New})
       ; reply_json_dict(_{valid:false}))),
      _, reply_json_dict(_{valid:false}, [status(400)])).

api_solve(Req) :-
    catch((http_read_json_dict(Req,D), N=D.disks, P=D.pegs,
      must_be(integer,N), must_be(integer,P), between(1,10,N), P=:=3,
      hanoi(N,0,2,1,M), maplist(move_json,M,JM), reply_json_dict(_{moves:JM})),
      _, reply_json_dict(_{error:"Use 1-10 disks and exactly 3 pegs."}, [status(400)])).
move_json(move(F,T), _{from:F,to:T}).

main :-
    http_server(http_dispatch,[port(8080)]),
    format('Tower of Hanoi running at http://localhost:8080~n', []),
    thread_get_message(_).
:- initialization(main, main).
