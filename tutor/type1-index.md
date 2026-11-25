# 데이터마님 작업형 1유형 개념 색인

사용자 제공 분석보고서의 색인을 옮겼다. 출제 전 내부 매핑용이며 학생에게는 해당 문항의 개념만 보여준다. 난이도와 번호는 보고서 확인 시점 기준이다.

[데이터마님 1유형 연습문제](https://www.datamanim.com/learn/bigdata-practical/type-1-practice)

### 1유형 연습 120문항 색인

번호 범위의 난이도는 사이트 공시 기준이다. 오른쪽은 풀이 방향을 잡는 함수 후보이며, 적용 조건과 출력 형식은 원문을 확인한다.


#### 하

| 문제 | 핵심 개념 | pandas·Python |
|---:|---|---|
| 1 | 행 수 | len |
| 2 | 조건 최대 | loc,max |
| 3 | 국가 필터 행수 | eq,sum |
| 4 | 거래량 최대 | max |
| 5 | 성별 종류 | nunique |
| 6 | 흡연자 수 | eq,sum |
| 7 | 영상별 빈도 | value_counts |
| 8 | 최신행·비율 순위 | sort_values,drop_duplicates,div |
| 9 | 국가 집계 | groupby,agg |
| 10 | 출전연도 조건 | str.contains,sum |
| 11 | 연령별 복수 집계 | groupby,agg |
| 12 | 날짜·연령 중앙값 | loc,median |
| 13 | 평균 기준 표준편차 | mean,loc,std |
| 14 | 성별 거리 평균 | loc,mean |
| 15 | 월별 시간대 평균 최댓값 | to_datetime,groupby,idxmax |
| 16 | 전력 상관 | corr,loc |
| 17 | 기온 구간 빈도 | cut,value_counts |
| 18 | 월·시각 표준편차 | dt,loc,std |
| 19 | 월·시각 분산 | dt,loc,var |
| 20 | 그룹 내 상위 N 평균 | groupby,nlargest,mean |
| 21 | 조합 최빈 | groupby,size,idxmax |
| 22 | 혈압 차이 평균 | sub,mean |
| 23 | 연령 필터 평균 | loc,mean |
| 24 | 복합 조건 평균 | between,loc,mean |
| 25 | 성별 악력 평균 차이 | groupby,mean,abs |
| 26 | 성별 운동 평균 차이 | groupby,mean,abs |
| 27 | 복합 범주 평균 | loc,mean |
| 28 | 잔액 조건 표준편차 | loc,std |
| 29 | 최빈 범주 재조회 | mode,loc,describe |
| 30 | 품질별 표준편차 차이 | groupby,std |
| 31 | 위험군 평균 | groupby,mean |
| 32 | 월 필터 연도별 평균 | dt,groupby,mean |
| 33 | 팀 필터 평균 | loc,mean |
| 34 | 최솟값 행의 최빈 범주 | min,loc,mode |
| 35 | 그룹 평균 2위 | groupby,mean,sort_values,iloc |
| 36 | 그룹 평균 3위 | groupby,mean,sort_values,iloc |
| 37 | 그룹 최댓값들의 평균 | groupby,max,mean |
| 38 | 팀·포지션 필터 평균 | loc,mean |
| 39 | 경기수 조건과 평균 | loc,mean |
| 40 | 조건별 평균 비교 | loc,mean |

#### 중

| 문제 | 핵심 개념 | pandas·Python |
|---:|---|---|
| 41 | 요일·범주별 건수 | dt.dayofweek,groupby,size |
| 42 | 반응 비율 비교 | div,sort_values |
| 43 | 최빈 채널 | value_counts |
| 44 | 최소 빈도 충족 그룹 수 | value_counts,ge,sum |
| 45 | 날짜 필터 첫 기록 | to_datetime,loc,iloc |
| 46 | 그룹별 관측 간격 | sort_values,groupby,diff |
| 47 | 국가별 빈도 비교 | value_counts |
| 48 | 연도 문자열 형식 점검 | str.fullmatch |
| 49 | 정상 형식 행 수 | str.fullmatch,sum |
| 50 | 출전·득점 복합 조건 | str.split,loc |
| 51 | 이름 부분 일치 | str.contains,sum |
| 52 | 출전 조건 득점 최대 | str.split,loc,max |
| 53 | 출전 조건 국가 최빈 | loc,value_counts |
| 54 | 요일별 빈도 | dt.dayofweek,value_counts |
| 55 | 연령 조건 평균 | loc,mean |
| 56 | 상위 국가의 연도별 평균 | sort_values,isin,groupby,mean |
| 57 | 두 열 상관 | corr |
| 58 | 연도별 순위 비교 | pivot,eq,sum |
| 59 | 국가별 점수 변화 | pivot,sub,max |
| 60 | 월 단위 건수 | to_datetime,groupby,size |
| 61 | 월 필터 시간대 최저 평균 | dt,groupby,idxmin |
| 62 | 전력 조건 평균 | loc,mean |
| 63 | 타입별 조건 집계 | loc,groupby,agg |
| 64 | 최빈 그룹의 파생 비율 | value_counts,loc,div |
| 65 | 조건부 그룹 빈도 최대 | loc,value_counts |
| 66 | 그룹별 하위 N 평균 | groupby,nsmallest,mean |
| 67 | 단발 조합 수 | groupby,size,eq,sum |
| 68 | 성별 필터와 등급 평균 차이 | loc,groupby,mean |
| 69 | 계절 필터 지역 비교 | dt.month,isin,groupby |
| 70 | 조건부 국가별 이탈 수 | loc,groupby,sum |
| 71 | 신체 비율 조건과 성별 비중 | div,loc,value_counts |
| 72 | 다중 그룹 평균 | groupby,mean |
| 73 | 결측 기준 좌석·만족도 집계 | isna,loc,groupby |
| 74 | 하위 분위 평균 | quantile,loc,mean |
| 75 | 타깃과 상관 큰 열 | corr,sort_values |
| 76 | 상위 범주 재집계 | value_counts,isin,groupby |
| 77 | 조건별 혈압 평균 차이 | groupby,mean |
| 78 | 최빈 이름 건수 | value_counts,iloc |
| 79 | 팀 평균 최소 | groupby,mean,idxmin |
| 80 | 포지션별 평균 | groupby,mean |

#### 상

| 문제 | 핵심 개념 | pandas·Python |
|---:|---|---|
| 81 | 채널별 조회 집계 | groupby,sum,idxmax |
| 82 | 반응 비교 조건의 채널 | loc |
| 83 | 채널명 변경 여부 | groupby,nunique,gt |
| 84 | 요일·범주 반응 집계 | dt.dayofweek,loc,groupby,agg |
| 85 | 댓글 비율 상위 | div,sort_values |
| 86 | 댓글 비율 하위 | div,sort_values |
| 87 | 영상별 최신행 | sort_values,drop_duplicates |
| 88 | 채널 기록 연결·증가량 | merge,sub |
| 89 | 영상별 최초 날짜 | to_datetime,groupby,min |
| 90 | 시각 필터·영상별 첫 관측 | dt.hour,sort_values,drop_duplicates |
| 91 | 기간 내 영상 변화량 | loc,sort_values,groupby,agg,sub |
| 92 | 중복 관측 | duplicated,groupby |
| 93 | 국가·출전 횟수 조건 | loc,str.split |
| 94 | 일별 복수 집계 | dt.date,groupby,agg |
| 95 | 요일별 대여소 최빈 | groupby,size,idxmax |
| 96 | 연령별 이용권 비율 | groupby,mean |
| 97 | 평일·출근 시간대 대여소 빈도 | dt,loc,value_counts |
| 98 | 순위·GDP 복합 조건 | loc,between |
| 99 | 여러 지표 상관 비교 | corr,sort_values |
| 100 | 하위 국가의 연도별 평균 | sort_values,isin,groupby |
| 101 | GDP 필터별 평균 차이 | loc,mean |
| 102 | 상위 국가의 연도별 평균 | sort_values,isin,groupby |
| 103 | 연도 간 순위 이탈 | pivot,loc |
| 104 | 평균 기준 필터 후 정렬 | mean,loc,sort_values |
| 105 | 중앙값 기준 필터 후 정렬 | median,loc,sort_values |
| 106 | 두 번째 타입의 최빈값 | mode |
| 107 | 수치 열 상관 | corr |
| 108 | 드문 조합의 세대 분포 | groupby,size,merge,value_counts |
| 109 | 연령대 빈도 최대 | value_counts,max |
| 110 | 두 범주의 조합별 행수 | groupby,size,sort_values |
| 111 | 성별·등급 평균 체중 대비 | loc,groupby,mean |
| 112 | 남성 BMI 산출과 평균 | div,loc,mean |
| 113 | 특정 지역 강수량 최대 행 | loc,idxmax |
| 114 | 혈압 차이 그룹 분산 | sub,groupby,var |
| 115 | 중앙값 기준 조건부 평균 | median,loc,mean |
| 116 | 그룹별 코어 최빈 | groupby,size,sort_values |
| 117 | 필터 후 상관계수 쌍 추출 | loc,corr,stack,sort_values |
| 118 | 그룹별 분위수 기준 평균 | transform,quantile,loc,groupby |
| 119 | 남성 연령대 그룹 평균 | loc,groupby,mean |
| 120 | 다수 열의 그룹 중앙값 대비 | groupby,median,sub,abs |


